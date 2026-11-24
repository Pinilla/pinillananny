# pinillananny

A weekly time sheet for our nanny. She taps "I'm here!" when she arrives and "I'm leaving!" when she goes, and the page totals the week's hours to the hundredth. Tap the total to copy it, then paste it into Poppins Payroll.

## Using it

- The week runs Monday to Sunday. The arrows move between weeks.
- "I'm here!" and "I'm leaving!" fill in today's times from the phone's clock. If today already has a time, the page asks before replacing it.
- Any time on any day can be typed or changed by hand. Changes save as soon as a field loses focus.
- A day counts toward the total only when it has both times and "Left" is after "Arrived". The page lists any day that's missing a time.
- The total adds up whole minutes first and rounds once at the end. A day's own hours are rounded on their own, so the day figures can add up to 0.01 more or less than the total. The total is the accurate one.
- On iPhone, Share > Add to Home Screen gives it an app icon.

## Login

One PIN, set with `NANNY_PIN` (4 to 8 digits). A phone that enters it stays logged in for a year. Changing the PIN logs every phone out. After 5 wrong PINs from one address, or 30 in total in an hour, the login waits before accepting more.

## Data

`$NANNY_DATA/days.json` holds the times, keyed by date:

```json
{ "2026-11-24": { "in": "07:58", "out": "17:13" } }
```

`$NANNY_DATA/changes.jsonl` gets a line for every change, with the time of the change and the day's times before and after. `$NANNY_DATA/secret` signs the login cookie.

## Running it

Node 24 or later runs the TypeScript directly, with no build step and no dependencies.

```sh
npm test
NANNY_PIN=1234 npm start          # http://127.0.0.1:3300
```

| Variable | Default | Meaning |
|---|---|---|
| `NANNY_PIN` | none, required | The login PIN |
| `HOST` | `127.0.0.1` | Address to listen on |
| `PORT` | `3300` | Port to listen on |
| `NANNY_DATA` | `./data` | Folder for the data files |

`deploy/` has the systemd unit, the nginx block and the deploy script used on the home server.
