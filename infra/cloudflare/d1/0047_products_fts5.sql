CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
  body,
  tokenize='unicode61 remove_diacritics 2'
);

INSERT INTO products_fts(rowid, body)
SELECT rowid, search_text FROM products WHERE trim(search_text) != '';

CREATE TRIGGER IF NOT EXISTS products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts(rowid, body) VALUES (new.rowid, new.search_text);
END;

CREATE TRIGGER IF NOT EXISTS products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, body) VALUES ('delete', old.rowid, old.search_text);
END;

CREATE TRIGGER IF NOT EXISTS products_fts_au AFTER UPDATE OF search_text ON products BEGIN
  INSERT INTO products_fts(products_fts, rowid, body) VALUES ('delete', old.rowid, old.search_text);
  INSERT INTO products_fts(rowid, body) VALUES (new.rowid, new.search_text);
END;
