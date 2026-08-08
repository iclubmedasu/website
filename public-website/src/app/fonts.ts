import localFont from 'next/font/local'

export const poppins = localFont({
    src: [
        { path: '../fonts/Poppins-Regular.woff2', weight: '400', style: 'normal' },
        { path: '../fonts/Poppins-Medium.woff2', weight: '500', style: 'normal' },
        { path: '../fonts/Poppins-SemiBold.woff2', weight: '600', style: 'normal' },
        { path: '../fonts/Poppins-Bold.woff2', weight: '700', style: 'normal' },
        { path: '../fonts/Poppins-ExtraBold.woff2', weight: '800', style: 'normal' },
    ],
    variable: '--font-poppins',
    display: 'swap',
})

export const arimo = localFont({
    src: '../fonts/Arimo-Variable.woff2',
    weight: '400 700',
    variable: '--font-arimo',
    display: 'swap',
})
