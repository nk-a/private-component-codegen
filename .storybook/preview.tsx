import React from 'react';
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../app/components/ThemeProvider';
import '../app/globals.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#000000'
        }
      ]
    }
  }
};

export const decorators = [
  (Story) => (
    <ThemeProvider isDarkMode={true}>
      <Story />
    </ThemeProvider>
  )
];

export default preview;
