-- Rename standard capabilities (backward-compat handled in app until deploy)
UPDATE integration_operations SET capability = 'payment.create_link' WHERE capability = 'payment.create_checkout';
UPDATE integration_operations SET capability = 'payment.verify' WHERE capability = 'payment.get_status';
UPDATE integration_operations SET capability = 'catalog.search' WHERE capability = 'catalog.list_products';
UPDATE integration_operations SET capability = 'catalog.get' WHERE capability = 'catalog.get_product';
UPDATE integration_operations SET capability = 'order.status' WHERE capability = 'order.get_status';

ALTER TABLE integration_operations ADD COLUMN params_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE integration_operations ADD COLUMN request_json TEXT;
ALTER TABLE integration_operations ADD COLUMN response_json TEXT;
ALTER TABLE integration_operations ADD COLUMN tool_name TEXT;
ALTER TABLE integration_operations ADD COLUMN description TEXT;
ALTER TABLE integration_operations ADD COLUMN requires_confirm INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_operations_tool_name
  ON integration_operations(definition_id, definition_version, tool_name)
  WHERE tool_name IS NOT NULL AND tool_name != '';
