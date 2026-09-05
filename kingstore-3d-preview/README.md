# KINGSTORE 3D Preview

Безопасный отдельный прототип для ARSLAN WEB LAB.

## Стек

- Next.js 16 / React 19 / TypeScript
- GSAP + ScrollTrigger
- Lenis
- Three.js + React Three Fiber + Drei

## Что реализовано

- процедурная WebGL-модель смартфона без внешних ассетов;
- scroll-driven exploded view;
- pointer parallax;
- adaptive DPR;
- отключение motion;
- `prefers-reduced-motion`;
- CSS fallback при недоступности WebGL;
- desktop/mobile responsive layout.

## Запуск

```bash
npm install
npm run typecheck
npm run dev
```

Production:

```bash
npm run build
npm run start
```

Проект хранится в отдельной ветке и не меняет действующий KINGSTORE production.
