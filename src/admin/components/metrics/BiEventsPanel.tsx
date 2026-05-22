interface Props {
  registrationsLocal?: number;
  registrationsGoogle?: number;
  registrationsTelegram?: number;
  matches?: number;
  messages?: number;
  topicsCreated?: number;
}

export function BiEventsPanel({
  registrationsLocal = 0,
  registrationsGoogle = 0,
  registrationsTelegram = 0,
  matches = 0,
  messages = 0,
  topicsCreated = 0,
}: Props) {
  const Row = ({ label, value }: { label: string; value: string | number }) => (
    <div className="flex items-center justify-between py-1 text-sm border-t border-border first:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div>
      <Row
        label="Registrations"
        value={`${registrationsLocal} local · ${registrationsGoogle} Google · ${registrationsTelegram} Telegram`}
      />
      <Row label="Matches" value={matches} />
      <Row label="Messages" value={messages} />
      <Row label="Topics created" value={topicsCreated} />
    </div>
  );
}
