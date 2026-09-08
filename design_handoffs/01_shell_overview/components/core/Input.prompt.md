Single-line field used for login password, user search and custom date range.

```jsx
<Input type="search" placeholder="Search name, email, team, or phone" value={q} onChange={e => setQ(e.target.value)} />
```

16px text on mobile avoids iOS zoom; focus = ink border + 2px ink-100 ring. No labels above fields; placeholders carry the label.
