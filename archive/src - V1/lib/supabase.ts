import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xarnvryaicseavgnmtjn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhcm52cnlhaWNzZWF2Z25tdGpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NjU3NzIsImV4cCI6MjA2ODI0MTc3Mn0.KD5zIW2WjE14Q4UcYIRc1rt5wtAweqMefIEgqHm1qtw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);