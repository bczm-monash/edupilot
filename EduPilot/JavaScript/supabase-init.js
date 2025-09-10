
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://erjpryssctucueorbptl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RzDoj2kNzUxeyhkseS429Q_7hdUhF44';

// Expose on window so non-module scripts can use it
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.debug('[Supabase] Client initialized');

