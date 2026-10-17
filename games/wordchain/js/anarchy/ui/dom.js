export function el(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export const button = (label, onClick, cls = '', attrs = {}) => {
  const b = el('button', cls, label, { type: 'button', ...attrs });
  b.addEventListener('click', onClick);
  return b;
};

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
