Metric tile used in 3-up funnel/revenue grids and 2/4-up onboarding KPIs; clicking one filters the people list.

```jsx
<div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
  <StatCard label="Signed up" value={128} sub="100%" selected />
  <StatCard label="Trial started" value={54} sub="42.2% of signups" />
  <StatCard label="Paying" value={21} sub="16.4% of signups" accent />
</div>
```

`accent` only for money/paying. Numbers are tabular.
