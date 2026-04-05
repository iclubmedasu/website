import express from 'express'
import type { Router } from 'express'

export interface TestRequestUser {
    memberId: number
    isDeveloper: boolean
    isOfficer: boolean
    isAdmin: boolean
    isLeadership: boolean
    isSpecial: boolean
}

const defaultUser: TestRequestUser = {
    memberId: 1,
    isDeveloper: false,
    isOfficer: false,
    isAdmin: false,
    isLeadership: false,
    isSpecial: false
}

export function buildRouteApp(router: Router, user: Partial<TestRequestUser> = {}): express.Express {
    const app = express()

    app.use(express.json())
    app.use((req, _res, next) => {
        ; (req as any).user = {
            ...defaultUser,
            ...user
        }
        next()
    })

    app.use('/', router)

    return app
}
