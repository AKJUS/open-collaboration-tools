// ******************************************************************************
// Copyright 2024 TypeFox GmbH
// This program and the accompanying materials are made available under the
// terms of the MIT License, which is available in the project root.
// ******************************************************************************

import { fromBase64, toBase64 } from './base64.js';

export interface KeyPair {
    publicKey: string;
    privateKey: string;
}

export interface CryptoLib {
    /**
     * Encrypts the given data with the given key.
     */
    symEncrypt(data: Uint8Array, key: string, iv: string): Promise<Uint8Array>;
    /**
     * Decrypts the given data with the given key.
     */
    symDecrypt(data: Uint8Array, key: string, iv: string): Promise<Uint8Array>;
    generateSymKey(): Promise<string>;
    generateIV(): Promise<string>;
    publicEncrypt(data: Uint8Array, key: string): Promise<Uint8Array>;
    privateDecrypt(data: Uint8Array, key: string): Promise<Uint8Array>;
    /**
     * Generates a random key pair.
     */
    generateKeyPair(): Promise<KeyPair>;
}

export type CryptoModule = typeof self.crypto | typeof import('node:crypto').webcrypto;
let cryptoModule: CryptoModule | undefined;

export const setCryptoModule = (cm: CryptoModule): void => {
    cryptoModule = cm;
};

export const getCryptoLib = (): CryptoLib => {
    if (cryptoModule === undefined) {
        throw new Error('Crypto module is not available. Please call the initializeProtocol() function first.');
    }
    const subtle = cryptoModule.subtle;
    return {
        async generateKeyPair() {
            const pair = await subtle.generateKey({
                name: 'RSA-OAEP',
                modulusLength: 4096,
                publicExponent: new Uint8Array([1, 0, 1]),
                hash: 'SHA-256'
            }, true, ['encrypt', 'decrypt']);
            const exportedPublic = await subtle.exportKey('spki', pair.publicKey);
            const exportedPrivate = await subtle.exportKey('pkcs8', pair.privateKey);
            return {
                privateKey: toBase64(new Uint8Array(exportedPrivate)),
                publicKey: toBase64(new Uint8Array(exportedPublic))
            };
        },
        async generateSymKey() {
            const key = await subtle.generateKey({
                name: 'AES-CBC',
                length: 256
            }, true, ['encrypt', 'decrypt']);
            const exportedKey = await subtle.exportKey('raw', key);
            return toBase64(new Uint8Array(exportedKey));
        },
        async generateIV() {
            const iv = (crypto.getRandomValues<Uint8Array>)(new Uint8Array(16));
            return toBase64(iv);
        },
        async symEncrypt(data: Uint8Array, key: string, iv: string) {
            const cryptoKey = await subtle.importKey('raw', fromBase64(key), 'AES-CBC', false, ['encrypt']);
            const arrayBuffer = await subtle.encrypt({
                name: 'AES-CBC',
                iv: fromBase64(iv),
            }, cryptoKey, data);
            return new Uint8Array(arrayBuffer);
        },
        async symDecrypt(data: Uint8Array, key: string, iv: string) {
            const cryptoKey = await subtle.importKey('raw', fromBase64(key), 'AES-CBC', false, ['decrypt']);
            const arrayBuffer = await subtle.decrypt({
                name: 'AES-CBC',
                iv: fromBase64(iv),
            }, cryptoKey, data);
            return new Uint8Array(arrayBuffer);
        },
        async publicEncrypt(data: Uint8Array, key: string) {
            const publicKey = await subtle.importKey(
                'spki',
                fromBase64(key),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                false,
                ['encrypt']
            );
            const encrypted = await subtle.encrypt({
                name: 'RSA-OAEP'
            }, publicKey, data);
            return new Uint8Array(encrypted);
        },
        async privateDecrypt(data: Uint8Array, key: string) {
            const privateKey = await subtle.importKey(
                'pkcs8',
                fromBase64(key),
                { name: 'RSA-OAEP', hash: 'SHA-256' },
                true,
                ['decrypt']
            );
            const decrypted = await subtle.decrypt({
                name: 'RSA-OAEP'
            }, privateKey, data);
            return new Uint8Array(decrypted);
        }
    };
};

