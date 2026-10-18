-- Events of accounts deleted before deletion cascaded to them (right to erasure).
DELETE FROM "AnalyticsEvent" WHERE "userId" IS NULL;
