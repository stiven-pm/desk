-- WhatsApp: productos con campo libre para adiciones (salsas, toppings, etc.)
ALTER TABLE products ADD COLUMN allows_additions INTEGER NOT NULL DEFAULT 0;
