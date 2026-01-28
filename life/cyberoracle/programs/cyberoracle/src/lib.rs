use anchor_lang::prelude::*;

declare_id!("862LYnc3jZJ6bFmjyMjE9NMwehJaAe2Do5UbbEV1kbJU");

#[program]
pub mod cyberoracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, price_lamports: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.treasury = ctx.accounts.treasury.key();
        state.price_lamports = price_lamports;
        state.bump = ctx.bumps.state;
        Ok(())
    }

    pub fn update_price(ctx: Context<UpdatePrice>, price_lamports: u64) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.state.authority,
            CyberOracleError::Unauthorized
        );
        ctx.accounts.state.price_lamports = price_lamports;
        Ok(())
    }

    pub fn request_oracle(
        ctx: Context<RequestOracle>,
        prompt_hash: [u8; 32],
    ) -> Result<()> {
        let state = &ctx.accounts.state;
        require!(state.price_lamports > 0, CyberOracleError::InvalidPrice);

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.payer.key(),
            &ctx.accounts.treasury.key(),
            state.price_lamports,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.payer.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        let counter = &mut ctx.accounts.counter;
        if counter.user == Pubkey::default() {
            counter.user = ctx.accounts.payer.key();
            counter.bump = ctx.bumps.counter;
        } else {
            require_keys_eq!(
                counter.user,
                ctx.accounts.payer.key(),
                CyberOracleError::Unauthorized
            );
        }
        let request = &mut ctx.accounts.request;
        request.user = ctx.accounts.payer.key();
        request.request_id = counter.next_request_id;
        request.prompt_hash = prompt_hash;
        request.result_uri = String::new();
        request.asset_id = Pubkey::default();
        request.collection_mint = Pubkey::default();
        request.fulfilled = false;
        request.bump = ctx.bumps.request;

        counter.next_request_id = counter
            .next_request_id
            .checked_add(1)
            .ok_or(CyberOracleError::RequestIdOverflow)?;
        Ok(())
    }

    pub fn fulfill_oracle(
        ctx: Context<FulfillOracle>,
        result_uri: String,
        asset_id: Pubkey,
        collection_mint: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.state.authority,
            CyberOracleError::Unauthorized
        );
        require!(!ctx.accounts.request.fulfilled, CyberOracleError::AlreadyFulfilled);
        require!(result_uri.len() <= 200, CyberOracleError::ResultUriTooLong);
        require!(
            asset_id != Pubkey::default(),
            CyberOracleError::InvalidAssetId
        );

        let request = &mut ctx.accounts.request;
        request.result_uri = result_uri;
        request.asset_id = asset_id;
        request.collection_mint = collection_mint;
        request.fulfilled = true;
        Ok(())
    }
}

#[account]
pub struct OracleState {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub price_lamports: u64,
    pub bump: u8,
}

impl OracleState {
    pub const SIZE: usize = 8 + 32 + 32 + 8 + 1;
}

#[account]
pub struct UserCounter {
    pub user: Pubkey,
    pub next_request_id: u64,
    pub bump: u8,
}

impl UserCounter {
    pub const SIZE: usize = 8 + 32 + 8 + 1;
}

#[account]
pub struct OracleRequest {
    pub user: Pubkey,
    pub request_id: u64,
    pub prompt_hash: [u8; 32],
    pub result_uri: String,
    pub asset_id: Pubkey,
    pub collection_mint: Pubkey,
    pub fulfilled: bool,
    pub bump: u8,
}

impl OracleRequest {
    pub const MAX_RESULT_URI: usize = 200;
    pub const SIZE: usize = 8 + 32 + 8 + 32 + 4 + Self::MAX_RESULT_URI + 32 + 32 + 1 + 1;
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = OracleState::SIZE,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, OracleState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: treasury can be any system account
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut, seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, OracleState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RequestOracle<'info> {
    #[account(seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, OracleState>,
    #[account(
        init_if_needed,
        payer = payer,
        space = UserCounter::SIZE,
        seeds = [b"counter", payer.key().as_ref()],
        bump
    )]
    pub counter: Account<'info, UserCounter>,
    #[account(
        init,
        payer = payer,
        space = OracleRequest::SIZE,
        seeds = [b"request", payer.key().as_ref(), counter.next_request_id.to_le_bytes().as_ref()],
        bump
    )]
    pub request: Account<'info, OracleRequest>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: treasury can be any system account
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FulfillOracle<'info> {
    #[account(seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, OracleState>,
    #[account(
        mut,
        seeds = [
            b"request",
            request.user.as_ref(),
            request.request_id.to_le_bytes().as_ref()
        ],
        bump = request.bump
    )]
    pub request: Account<'info, OracleRequest>,
    pub authority: Signer<'info>,
}

#[error_code]
pub enum CyberOracleError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid price")]
    InvalidPrice,
    #[msg("Request already fulfilled")]
    AlreadyFulfilled,
    #[msg("Result URI too long")]
    ResultUriTooLong,
    #[msg("Invalid asset id")]
    InvalidAssetId,
    #[msg("Request id overflow")]
    RequestIdOverflow,
}
