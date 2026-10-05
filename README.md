# Security Deposit Helper

A free tool that helps renters get their security deposit back.

Pick your state, enter your move-out date and deposit amount, and it shows:

- your landlord's legal deadline to return the deposit or send an itemized list of deductions, and the exact date it falls on
- whether that deadline has passed
- what the landlord can owe for wrongly keeping the deposit
- a demand letter filled in with your details, the state's statute citation, the deadline and the penalty, which you can copy or download as a PDF

Covers all 50 states and DC. No login, no database, no tracking. Everything runs in your browser.

## Not legal advice

This is general information, not legal advice. Laws change and have exceptions, and cities and counties may have their own rules. Check your state's current law or talk to a local tenant organization or lawyer before you act.

## State data

All state rules live in [`states.json`](states.json). Each entry has the deadline, itemization rule, penalty, interest requirement, statute citation, source URL, and a short quote from the statute that supports the deadline.

- `flag` holds a plain-language warning where a state's rule has exceptions or a special process, or could not be confirmed on an official site.
- `official_source` is `false` where the text was read from a free copy of the code (such as Justia) because the official site was unreadable.
- `demand_starts_clock` marks states where the deadline only starts once the tenant asks for the deposit.
- Local ordinances (for example Chicago's) are not included.

The data was last reviewed in October 2026. Corrections are welcome: open an issue or pull request with a link to the statute.

## Run it locally

It is a static site with no build step. Serve the folder with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## License

[MIT](LICENSE)
