import type { Config } from 'tailwindcss/types/config';

export default {
  theme: {
    extend: {
      colors: {
        // Vibrant Violet-Cyan AI Theme
        neural: {
          50: '#f8faff',
          100: '#f0f4ff',
          200: '#e1eaff',
          300: '#c7d7ff',
          400: '#a5baff',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        cyber: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
          950: '#083344',
        },
        plasma: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        aurora: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        // Enhanced Glass Effects
        glass: {
          light: 'rgba(255, 255, 255, 0.15)',
          dark: 'rgba(0, 0, 0, 0.15)',
          border: 'rgba(255, 255, 255, 0.25)',
          'border-dark': 'rgba(255, 255, 255, 0.1)',
          violet: 'rgba(139, 92, 246, 0.1)',
          cyan: 'rgba(34, 211, 238, 0.1)',
        },
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',

        // Vibrant AI Gradients
        'neural-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #d946ef 100%)',
        'neural-gradient-dark': 'linear-gradient(135deg, #5b21b6 0%, #0891b2 30%, #a21caf 100%)',

        'cyber-gradient': 'linear-gradient(135deg, #22d3ee 0%, #8b5cf6 50%, #14b8a6 100%)',
        'cyber-gradient-dark': 'linear-gradient(135deg, #0891b2 0%, #5b21b6 50%, #0d9488 100%)',

        'plasma-gradient': 'linear-gradient(135deg, #d946ef 0%, #06b6d4 30%, #8b5cf6 70%, #22d3ee 100%)',
        'plasma-gradient-dark': 'linear-gradient(135deg, #a21caf 0%, #0891b2 30%, #5b21b6 70%, #155e75 100%)',

        'aurora-gradient': 'linear-gradient(135deg, #14b8a6 0%, #8b5cf6 40%, #d946ef 80%, #22d3ee 100%)',
        'aurora-gradient-dark': 'linear-gradient(135deg, #0d9488 0%, #5b21b6 40%, #a21caf 80%, #0891b2 100%)',

        // Animated Backgrounds
        'neural-flow':
          'radial-gradient(circle at 20% 80%, #8b5cf6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #06b6d4 0%, transparent 50%), radial-gradient(circle at 40% 40%, #d946ef 0%, transparent 50%)',
        'cyber-mesh':
          'conic-gradient(from 230.29deg at 51.63% 52.16%, #06b6d4 0deg, #8b5cf6 67.5deg, #22d3ee 198.75deg, #d946ef 251.25deg, #14b8a6 301.88deg, #06b6d4 360deg)',
      },
      backdropBlur: {
        xs: '2px',
        '3xl': '64px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-neural': 'pulse-neural 3s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        'gradient-x': 'gradient-x 15s ease infinite',
        'gradient-xy': 'gradient-xy 20s ease infinite',
        'neural-flow': 'neural-flow 25s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        'glow-rotate': 'glow-rotate 4s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(34, 211, 238, 0.2)',
          },
          '50%': {
            opacity: '0.9',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.6), 0 0 60px rgba(34, 211, 238, 0.3)',
          },
        },
        'pulse-neural': {
          '0%, 100%': {
            opacity: '1',
            transform: 'scale(1)',
            boxShadow: '0 0 30px rgba(217, 70, 239, 0.3), 0 0 60px rgba(139, 92, 246, 0.2)',
          },
          '50%': {
            opacity: '0.8',
            transform: 'scale(1.05)',
            boxShadow: '0 0 50px rgba(217, 70, 239, 0.5), 0 0 100px rgba(139, 92, 246, 0.3)',
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center',
          },
        },
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': 'left center',
          },
          '50%': {
            'background-size': '400% 400%',
            'background-position': 'right center',
          },
        },
        'neural-flow': {
          '0%, 100%': {
            'background-position': '0% 50%',
          },
          '50%': {
            'background-position': '100% 50%',
          },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'glow-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',

        neural: '0 10px 40px rgba(139, 92, 246, 0.3), 0 0 0 1px rgba(139, 92, 246, 0.2)',
        'neural-dark': '0 10px 40px rgba(139, 92, 246, 0.4), 0 0 0 1px rgba(139, 92, 246, 0.3)',

        cyber: '0 10px 40px rgba(34, 211, 238, 0.3), 0 0 0 1px rgba(34, 211, 238, 0.2)',
        'cyber-dark': '0 10px 40px rgba(34, 211, 238, 0.4), 0 0 0 1px rgba(34, 211, 238, 0.3)',

        plasma: '0 15px 60px rgba(217, 70, 239, 0.4), 0 0 0 1px rgba(217, 70, 239, 0.3)',
        'plasma-dark': '0 15px 60px rgba(217, 70, 239, 0.5), 0 0 0 1px rgba(217, 70, 239, 0.4)',

        aurora: '0 12px 50px rgba(20, 184, 166, 0.3), 0 0 0 1px rgba(20, 184, 166, 0.2)',
        'aurora-dark': '0 12px 50px rgba(20, 184, 166, 0.4), 0 0 0 1px rgba(20, 184, 166, 0.3)',

        'multi-glow':
          '0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(34, 211, 238, 0.3), 0 0 60px rgba(217, 70, 239, 0.2)',
        'multi-glow-dark':
          '0 0 30px rgba(139, 92, 246, 0.6), 0 0 60px rgba(34, 211, 238, 0.4), 0 0 90px rgba(217, 70, 239, 0.3)',
      },
    },
  },
  plugins: [],
} as Omit<Config, 'content'>;
