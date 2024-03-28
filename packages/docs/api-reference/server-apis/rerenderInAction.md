---
description: rerender the component or the page inside a server action
---

# rerenderInAction

## Reference

### `rerenderInPage({ type, mode }: { type: 'component' | 'page', mode: 'reactivity' | 'transition' }): Never`

The `rerenderInAction` method is used to rerender the component or the page
inside a server action. Outside of an action, it throws an error.

`rerenderInAction` needs to be called outside of the `try/catch` block:

```tsx
import { rerenderInAction } from "brisa";

// Inside a server action
function handleEvent() {
  try {
    // ...
  } catch (error) {
    // ...
  }

  // Trigger a full-page rerender
  rerenderInAction({ type: "page" });
}
```

#### Parameters:

- `type`: The type of the rerender. It can be `component` or `page`. By default, it is `component`.
- `mode`: The type of the rerender. It can be `reactivity` or `transition`. By default, it is `reactivity`.

#### Returns:

- `Never` does not require you to use `return rerenderInPage()` due to using the TypeScript [`never`](https://www.typescriptlang.org/docs/handbook/2/functions.html#never) type.

> [!TIP]
>
> Updating [`Action Signals`](/building-your-application/data-fetching/server-actions#action-signals) by default is going to use a `rerenderInAction` with `component` type and `reactivity` mode without you having to specify it. If you specify it, it will fulfill only the `rerenderInAction` you specify.

### Support

| Component         | Support |
| ----------------- | ------- |
| Server Component  | ❌      |
| Web Component     | ❌      |
| SSR Web Component | ❌      |
| Actions           | ✅      |
| Middleware        | ❌      |
| Response headers  | ❌      |