Text-label button in four variants; use for form submits, outreach actions (Text/Call/Email) and inline row actions.

```jsx
<Button>Enter</Button>
<Button variant="money" size="sm" href="sms:+1...">Text</Button>
<Button variant="secondary" size="sm">Call</Button>
```

- `variant`: primary (ink) · money (green, only for outreach "Text" and paying-related CTAs) · secondary (gray-100) · ghost
- `size`: lg (12px radius, 10×16 padding) · sm (8px radius, 36px min-height, 56px min-width)
- `block` stretches; `disabled` = 60% opacity. Never add icons; labels are single words.
