import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

export default mergeConfig(
    baseConfig,
    defineConfig({
        test: {
            coverage: {
                all: false,
                thresholds: {
                    lines: 35,
                    functions: 55,
                    statements: 35,
                    branches: 50
                }
            }
        }
    })
)
