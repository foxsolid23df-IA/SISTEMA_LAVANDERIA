import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock global de import.meta.env si es necesario
if (typeof process !== 'undefined') {
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.VITE_SUPABASE_ANON_KEY = 'example-key';
}
