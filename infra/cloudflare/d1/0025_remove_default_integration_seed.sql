DELETE FROM org_integration_instances
WHERE definition_id = 'def_desk_payment';

DELETE FROM integration_definitions WHERE id = 'def_desk_payment';
