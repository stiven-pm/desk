-- Combinable panel capabilities per member (JSON array). Null = derive from role.
ALTER TABLE memberships ADD COLUMN capabilities_json TEXT;
ALTER TABLE member_invites ADD COLUMN capabilities_json TEXT;
