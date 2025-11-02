-- Migration 1: Add new enum value
ALTER TYPE partner_combination_type ADD VALUE IF NOT EXISTS 'partner_only';