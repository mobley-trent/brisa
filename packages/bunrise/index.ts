import type { Props, JSXNode, JSXElement } from "../../types/index";

function renderAttributes(props: Props): string {
  let attributes = '';

  for (const prop in props) {
    if (prop !== 'children') attributes += ` ${prop}="${props[prop]}"`;
  }

  return attributes;
}

async function renderChildren(children: JSXNode | undefined): Promise<string> {
  const renderChild = (child: JSXNode | undefined) => {
    if (typeof child === 'string') return child;
    if (typeof child === 'object') return renderToString(child);
    return '';
  }

  if (Array.isArray(children)) return (await Promise.all(children.map(renderChild))).join('');

  return renderChild(children);
}

export async function renderToString({ type, props }: JSXElement): Promise<string> {
  if (typeof type === 'function') {
    let jsx = type(props)

    if (jsx instanceof Promise) return jsx.then(renderToString)
    if (typeof jsx === 'string' || typeof jsx === 'number') return jsx.toString()

    return renderToString(jsx)
  }

  const attributes = renderAttributes(props)
  const content = await renderChildren(props.children)

  return `<${type}${attributes}>${content}</${type}>`
}

export async function page(element: JSXElement, responseOptions?: ResponseInit) {
  return new Response(await renderToString(element), responseOptions ?? {
    headers: {
      'content-type': 'text/html;charset=UTF-8'
    }
  })
}
