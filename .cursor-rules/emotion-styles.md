在 styles.ts（没有则创建） 文件中用@ant-design/use-emotion-css 给组件写样式， 最终导出提供给 4、[组件名].tsx。例如：

```tsx
import { useEmotionCss } from '@ant-design/use-emotion-css';

export const useClassName = () => {
  const className = useEmotionCss(({ token }) => {
    return {};
  });
  return className;
};
```
