-- Store the opinion paragraph text at the time a counterpoint was created (context for readers/moderation).

ALTER TABLE opinion_sentence_counterpoints ADD COLUMN IF NOT EXISTS paragraph_text text;
