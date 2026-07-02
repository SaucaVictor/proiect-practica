-- Add open_resources_on_new_chat column to user settings table
ALTER TABLE public.settings
ADD COLUMN open_resources_on_new_chat BOOLEAN NOT NULL DEFAULT FALSE;
