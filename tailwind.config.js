/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
      fontFamily: {
        assistant: ['var(--font-assistant)'],
        'home-sans': ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'home-display': ['"Instrument Serif"', 'Georgia', 'serif']
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
        assistant: {
          canvas: 'hsl(var(--assistant-canvas) / <alpha-value>)',
          surface: 'hsl(var(--assistant-surface) / <alpha-value>)',
          elevated: 'hsl(var(--assistant-elevated) / <alpha-value>)',
          ink: 'hsl(var(--assistant-ink) / <alpha-value>)',
          muted: 'hsl(var(--assistant-muted) / <alpha-value>)',
          border: 'hsl(var(--assistant-border) / <alpha-value>)',
          primary: 'hsl(var(--assistant-primary) / <alpha-value>)',
          'on-primary': 'hsl(var(--assistant-on-primary) / <alpha-value>)',
          info: 'hsl(var(--assistant-info) / <alpha-value>)',
          warning: 'hsl(var(--assistant-warning) / <alpha-value>)',
          danger: 'hsl(var(--assistant-danger) / <alpha-value>)'
        },
        home: {
          navy: 'var(--home-navy)',
          'navy-ink': 'var(--home-navy-ink)',
          silver: 'var(--home-silver)',
          accent: 'var(--home-accent)',
          canvas: 'var(--home-canvas)',
          ink: 'var(--home-ink)',
          card: 'var(--home-card)',
          muted: 'var(--home-muted)',
          'muted-ink': 'var(--home-muted-ink)',
          line: 'var(--home-line)'
        },
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}