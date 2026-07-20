import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { showApiError } from '@/lib/apiError';
import {
  adminApi,
  type PreRegisterAttendeeInput,
  type PreRegisterResult,
} from '@/services/api/adminApi';

interface Props {
  eventId: string;
  onImported?: () => void;
}

/** Parses the pasted JSON array into attendee rows. Returns an error string instead of throwing. */
function parseAttendees(raw: string): { rows: PreRegisterAttendeeInput[]; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { rows: [], error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { rows: [], error: 'Could not parse JSON. Expected an array of attendee objects.' };
  }
  if (!Array.isArray(parsed)) {
    return { rows: [], error: 'Could not parse JSON. Expected an array of attendee objects.' };
  }

  const rows: PreRegisterAttendeeInput[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') {
      return { rows: [], error: 'Every entry must be an object.' };
    }
    const e = entry as Record<string, unknown>;
    const telegramUsername = typeof e.telegramUsername === 'string' ? e.telegramUsername.trim() : '';
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!telegramUsername || !name) {
      return { rows: [], error: 'Every entry needs a telegramUsername and a name.' };
    }
    const row: PreRegisterAttendeeInput = { telegramUsername, name };
    if (typeof e.gender === 'string' && e.gender.trim()) row.gender = e.gender.trim();
    if (typeof e.photoUrl === 'string' && e.photoUrl.trim()) row.photoUrl = e.photoUrl.trim();
    rows.push(row);
  }
  return { rows, error: null };
}

const STATUS_VARIANT: Record<string, string> = {
  created: 'text-green-600',
  skippedExists: 'text-muted-foreground',
  invalidUsername: 'text-destructive',
  invalidName: 'text-destructive',
  error: 'text-destructive',
};

export default function PreRegisterAttendeesCard({ eventId, onImported }: Props) {
  const [raw, setRaw] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PreRegisterResult | null>(null);

  const { rows, error } = useMemo(() => parseAttendees(raw), [raw]);

  const handleImport = async () => {
    if (!rows.length) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await adminApi.preRegisterAttendees(eventId, rows);
      if (!res.success || !res.data) throw res;
      setResult(res.data);
      toast.success(`Imported ${res.data.summary.created} of ${rows.length} attendees`);
      onImported?.();
    } catch (err) {
      showApiError(err, 'Failed to pre-register attendees');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-register attendees</CardTitle>
        <CardDescription>
          Paste a JSON array of attendees. Each needs <code>telegramUsername</code> and{' '}
          <code>name</code>; <code>gender</code> and <code>photoUrl</code> are optional. Accounts are
          created and registered as attendees. When a person first signs in with a matching Telegram
          username, their Telegram login is linked to the account automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="preregister-input">Attendee list (JSON)</Label>
          <Textarea
            id="preregister-input"
            rows={8}
            spellCheck={false}
            placeholder={'[\n  { "telegramUsername": "anna_p", "name": "Anna", "gender": "female" }\n]'}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!error && rows.length > 0 && (
            <p className="text-xs text-muted-foreground">{rows.length} attendees ready to import</p>
          )}
        </div>

        {!error && rows.length > 0 && (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Username</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Gender</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.telegramUsername} className="border-b last:border-0">
                    <td className="p-2 font-mono">{r.telegramUsername}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.gender ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div>
          <Button onClick={handleImport} disabled={submitting || !!error || rows.length === 0}>
            {submitting ? 'Importing…' : 'Import attendees'}
          </Button>
        </div>

        {result && (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Created: {result.summary.created}</Badge>
              <Badge variant="secondary">Skipped: {result.summary.skippedExists}</Badge>
              <Badge variant="secondary">Invalid username: {result.summary.invalidUsername}</Badge>
              <Badge variant="secondary">Invalid name: {result.summary.invalidName}</Badge>
              <Badge variant="secondary">Errors: {result.summary.error}</Badge>
            </div>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Username</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r) => (
                    <tr key={r.telegramUsername} className="border-b last:border-0">
                      <td className="p-2 font-mono">{r.telegramUsername}</td>
                      <td className={`p-2 ${STATUS_VARIANT[r.status] ?? ''}`}>{r.status}</td>
                      <td className="p-2 text-muted-foreground">{r.message ?? r.userId ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
