import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vmfpdysxofboofccsdcv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtZnBkeXN4b2Zib29mY2NzZGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2ODU5MDEsImV4cCI6MjA5NjI2MTkwMX0.3mFvm8Tk5F9DVWsVqJ5gt37tyOvH_rKtIIQxCZDL1LU';

export const supabase = createClient(supabaseUrl, supabaseKey);