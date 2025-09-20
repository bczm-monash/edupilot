
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://erjpryssctucueorbptl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RzDoj2kNzUxeyhkseS429Q_7hdUhF44';

try {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.supabase = client;

  document.dispatchEvent(new CustomEvent('supabase-ready', {
    detail: { supabase: client },
  }));

  console.debug('[Supabase] Client initialized');
} catch (err) {
  console.error('[Supabase] Failed to initialize client', err);
}
