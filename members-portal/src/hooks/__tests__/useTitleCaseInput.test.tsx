import { renderHook, act } from '@testing-library/react'
import type { ChangeEvent } from 'react'
import { describe, expect, it } from 'vitest'
import { titleCaseValue, useTitleCaseInput } from '../useTitleCaseInput'

describe('useTitleCaseInput hook', () => {
    it('keeps raw input while user is in the middle of a word', () => {
        const { result } = renderHook(() => useTitleCaseInput(''))

        act(() => {
            result.current[1]({ target: { value: 'john' } } as unknown as ChangeEvent<HTMLInputElement>)
        })

        expect(result.current[0]).toBe('john')
    })

    it('title-cases the value when the latest character is a space', () => {
        const { result } = renderHook(() => useTitleCaseInput(''))

        act(() => {
            result.current[1]({ target: { value: 'john doe ' } } as unknown as ChangeEvent<HTMLInputElement>)
        })

        expect(result.current[0]).toBe('John Doe ')
    })

    it('allows external updates through returned setter', () => {
        const { result } = renderHook(() => useTitleCaseInput('initial'))

        act(() => {
            result.current[2]('manually set')
        })

        expect(result.current[0]).toBe('manually set')
    })
})

describe('titleCaseValue helper', () => {
    it('transforms strings that end with a space', () => {
        expect(titleCaseValue('hello world ')).toBe('Hello World ')
    })

    it('does not change strings without trailing space', () => {
        expect(titleCaseValue('hello')).toBe('hello')
    })

    it('returns non-string values unchanged', () => {
        expect(titleCaseValue(42)).toBe(42)
        expect(titleCaseValue({ key: 'value' })).toEqual({ key: 'value' })
    })
})
