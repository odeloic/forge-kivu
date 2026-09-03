-- Custom SQL migration file, put your code below! --
INSERT INTO "units" ("name", "symbol", "slug", "sort_order")
VALUES
  ('Piece', 'pc', 'piece', 0),
  ('Metre', 'm', 'm', 1),
  ('Square metre', 'm²', 'm2', 2),
  ('Cubic metre', 'm³', 'm3', 3),
  ('Kilogram', 'kg', 'kg', 4),
  ('Tonne', 't', 'tonne', 5),
  ('Litre', 'L', 'litre', 6),
  ('Bag', 'bag', 'bag', 7),
  ('Roll', 'roll', 'roll', 8),
  ('Sheet', 'sheet', 'sheet', 9),
  ('Set', 'set', 'set', 10);
--> statement-breakpoint
UPDATE "product_variants"
SET "unit_id" = (SELECT "id" FROM "units" WHERE "slug" = 'piece')
WHERE "unit_id" IS NULL;
