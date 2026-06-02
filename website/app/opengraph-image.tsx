import { ImageResponse } from 'next/og';
import { appName } from '@/lib/shared';

export const dynamic = 'force-static';

export const alt = appName;
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090b',
          backgroundImage: 'radial-gradient(circle at 50% -20%, #1e1b4b 0%, #09090b 65%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '60px 80px',
          boxSizing: 'border-box',
          color: '#ffffff',
        }}
      >
        {/* Left Side: Branding & Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '580px',
            justifyContent: 'center',
          }}
        >
          {/* Logo + Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <svg
              viewBox="0 0 500 500"
              style={{ width: '44px', height: '44px', color: '#8b7ff6' }}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="250" cy="250" r="239.5" stroke="currentColor" strokeWidth="21" />
              <path
                d="M323.159 264.117C325.494 262.793 328.277 262.409 330.904 263.05L408.914 282.815V282.816C411.09 283.39 413.009 284.635 414.378 286.358C415.661 287.974 416.395 289.927 416.489 291.95L416.5 292.356V354.816C416.491 357.04 415.698 359.196 414.248 360.93C412.888 362.555 411.025 363.718 408.934 364.25L408.513 364.349L261.178 395.246V320.332L365.257 292.975L367.129 292.482L365.252 292.007L325.745 281.985L325.743 281.984C323.138 281.336 320.91 279.719 319.542 277.492C318.176 275.268 317.778 272.616 318.431 270.111C319.129 267.596 320.825 265.441 323.159 264.117ZM250.02 252.494C255.169 252.494 260.104 254.47 263.74 257.982C267.376 261.494 269.415 266.254 269.415 271.213C269.415 276.472 267.203 285.459 263.617 293.138C261.826 296.972 259.708 300.448 257.378 302.957C255.041 305.473 252.554 306.955 250.02 306.955C247.485 306.955 244.997 305.473 242.66 302.957C240.331 300.448 238.212 296.972 236.421 293.138C232.835 285.459 230.624 276.472 230.624 271.213C230.624 266.254 232.663 261.494 236.299 257.982C239.935 254.47 244.87 252.494 250.02 252.494ZM186.391 198.061C189.755 210.014 195.016 221.391 201.986 231.789C197.231 234.598 192.846 237.953 188.931 241.784L188.134 242.577C186.934 243.759 185.404 244.582 183.727 244.944C182.049 245.306 180.299 245.191 178.688 244.613C177.078 244.035 175.678 243.019 174.656 241.691C173.635 240.364 173.035 238.781 172.926 237.135L172.924 237.117C172.202 229.917 173.083 222.65 175.51 215.806C177.84 209.231 181.545 203.192 186.391 198.061ZM313.646 198.061C318.493 203.192 322.198 209.231 324.528 215.806C326.955 222.65 327.837 229.917 327.114 237.117L327.113 237.126V237.126C327.005 238.781 326.404 240.364 325.383 241.691C324.361 243.019 322.961 244.035 321.351 244.613C319.74 245.192 317.99 245.306 316.312 244.944C314.74 244.605 313.296 243.861 312.133 242.795L311.904 242.577C307.79 238.415 303.132 234.79 298.052 231.789C305.022 221.391 310.282 210.014 313.646 198.061ZM250.349 69.7256C250.709 69.9112 251.239 70.1905 251.915 70.5635C253.266 71.3094 255.2 72.4301 257.521 73.9248C262.163 76.9148 268.353 81.4 274.541 87.3779C286.921 99.3375 299.258 117.234 299.258 141.072C299.258 154.286 297.2 178.249 289.978 198.89C282.741 219.569 270.42 236.668 250.02 236.668C229.619 236.668 217.297 219.569 210.061 198.89C202.838 178.249 200.78 154.286 200.78 141.072C200.78 117.234 213.117 99.3375 225.497 87.3779C231.685 81.4 237.876 76.9148 242.519 73.9248C244.839 72.4302 246.773 71.3094 248.124 70.5635C248.799 70.1907 249.329 69.9112 249.689 69.7256C249.823 69.6568 249.933 69.6007 250.019 69.5576C250.104 69.6007 250.215 69.6566 250.349 69.7256ZM257.534 121.308C253.853 119.842 249.805 119.466 245.903 120.227C242.002 120.987 238.419 122.85 235.611 125.582C232.803 128.314 230.897 131.793 230.136 135.577C229.375 139.362 229.795 143.279 231.342 146.832C232.888 150.384 235.491 153.41 238.816 155.527C242.141 157.644 246.041 158.758 250.02 158.73V158.731L250.021 158.73L250.022 158.731L250.021 158.73C252.653 158.73 255.259 158.228 257.689 157.251C260.12 156.273 262.329 154.84 264.186 153.033C266.043 151.226 267.511 149.081 268.508 146.721C269.504 144.361 270.008 141.833 269.988 139.283C269.987 135.429 268.802 131.663 266.584 128.463C264.366 125.262 261.215 122.773 257.534 121.308ZM83.5391 293.155L83.5371 293.134C83.3338 290.832 83.9804 288.532 85.3662 286.644C86.7524 284.755 88.7897 283.397 91.1182 282.817L91.1211 282.816L169.708 262.636C172.334 261.997 175.114 262.383 177.447 263.706C179.781 265.03 181.478 267.184 182.177 269.699C182.83 272.203 182.431 274.856 181.065 277.08C179.698 279.307 177.469 280.924 174.864 281.572L174.862 281.573L132.229 292.281L132.227 293.25L238.861 320.609V395.384L91.5254 364.485H91.5264C89.2645 364.008 87.242 362.801 85.791 361.066C84.4312 359.441 83.6493 357.444 83.5498 355.368L83.5391 354.951V293.155Z"
                fill="currentColor"
              />
            </svg>
            <span style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.05em' }}>{appName}</span>
          </div>

          {/* Headline */}
          <span
            style={{
              fontSize: '48px',
              fontWeight: '700',
              lineHeight: '1.15',
              letterSpacing: '-0.03em',
              backgroundImage: 'linear-gradient(to right, #ffffff, #d4d4d8)',
              backgroundClip: 'text',
              color: 'transparent',
              marginBottom: '20px',
            }}
          >
            The self-hosted platform for apps, databases, and agents
          </span>

          {/* Subtitle */}
          <span style={{ fontSize: '20px', color: '#a1a1aa', lineHeight: '1.5', marginBottom: '36px' }}>
            Deploy from Git, manage services, and run production workloads on servers you control.
          </span>

          {/* Call to Action Badge */}
          <div style={{ display: 'flex' }}>
            <span
              style={{
                background: '#5e6ad2',
                color: '#ffffff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              curl -s https://better-paas.com/install.sh | bash
            </span>
          </div>
        </div>

        {/* Right Side: Mock Dashboard Representation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '420px',
            height: '420px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxSizing: 'border-box',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {/* Subtle gradient light flare in dashboard */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '1px',
              backgroundImage: 'linear-gradient(to right, rgba(255, 255, 255, 0.2), transparent)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: '1px',
              backgroundImage: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.2), transparent)',
            }}
          />

          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            </div>
            <span style={{ fontSize: '12px', color: '#a1a1aa', fontWeight: '500' }}>dashboard.better-paas.com</span>
          </div>

          {/* App Cards Representation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginTop: '24px' }}>
            {/* Card 1: storefront-web */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>storefront-web</span>
              </div>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace' }}>shop.acme.dev</span>
            </div>

            {/* Card 2: api-gateway */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>api-gateway</span>
              </div>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace' }}>building...</span>
            </div>

            {/* Card 3: analytics-edge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: '14px', fontWeight: '600' }}>analytics-edge</span>
              </div>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace' }}>stats.acme.dev</span>
            </div>
          </div>

          {/* Footer of mock dashboard */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '12px', marginTop: '16px' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Server RAM: 3.4 / 8 GB</span>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Docker: v26.1.1</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
