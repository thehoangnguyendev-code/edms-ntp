-- DC-XF-83: an Electronic Signature JWT (app.auth.signature-token-ttl-minutes, default 5 min) could
-- previously be replayed to authorize multiple independent GMP actions -- validateSigningRules() /
-- requireValidSignatureToken() only checked token validity + expiry + that it belonged to the
-- current user, never that it had already been spent. Every signature token carries a unique "sid"
-- claim generated fresh at issuance (TokenService.createSignatureToken), so it can be consumed
-- exactly once by recording that id here the first time it is successfully used; any later attempt
-- to reuse the same token is rejected.
CREATE TABLE used_signature_tokens (
    token_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id),
    used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_used_signature_tokens_used_at ON used_signature_tokens(used_at);
