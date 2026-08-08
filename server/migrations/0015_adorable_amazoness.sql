ALTER TABLE "characters" ADD CONSTRAINT "characters_max_street_cred_range" CHECK ("characters"."max_street_cred_achieved" >= 0 AND "characters"."max_street_cred_achieved" <= 100);
