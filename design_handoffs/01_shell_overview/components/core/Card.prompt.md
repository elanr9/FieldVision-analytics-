White bordered container (radius 16, 1px gray-200) that every section in the product sits in.

```jsx
<Card padding="none"><UserList … /></Card>
<Card interactive selected={picked} onClick={pick}>…</Card>
```

- `selected` turns the border ink (`--border-strong`). No shadow ever.
- `padding`: default 12 · wide 16 · none (lists with their own row padding).
