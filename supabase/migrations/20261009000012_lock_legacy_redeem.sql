-- =============================================================================
-- Lock the legacy redeem_consent_invite() to the backend.
--
-- Since MX-13 the web backend records teen-invite consent only after the parent
-- verifies their WhatsApp number by OTP (consent_invite_* functions, service role).
-- The older redeem_consent_invite() was still executable by anon/authenticated, so
-- anyone holding the link could record consent without that verification.
-- =============================================================================

revoke execute on function public.redeem_consent_invite(text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.redeem_consent_invite(text, text, text, text, jsonb) to service_role;
