-- Migration: 20240225_user_profile_phone.sql
-- Adds phone field to user_profiles table

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;
