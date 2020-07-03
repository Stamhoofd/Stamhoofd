import { EncryptedPrivateKey } from './EncryptedPrivateKey';
import { Sodium } from "./Sodium";

describe("EncryptedPrivateKey", () => {
    beforeAll( () => {
        // todo
    });

    test("Encrypt a private key with a password and try to regenerate it again", async () => {
        // Start of with generating a public  / private key pair
        const keypair = await Sodium.boxKeyPair()
        const encryptedPrivateKey = await EncryptedPrivateKey.encrypt(keypair.privateKey, "hello world")

        const decrypt = await encryptedPrivateKey.decrypt("hello world")
        expect(decrypt).toEqual(keypair.privateKey)

        // Try to decrypt something with this private key
        const plaintext = "This is a text 😄"
        const cyphertext = await Sodium.sealMessage(plaintext, keypair.publicKey)

        await expect(Sodium.unsealMessage(cyphertext, keypair.publicKey, decrypt)).resolves.toEqual(plaintext)
    });

    test("Using an invalid password to recover the private key should not work", async () => {
        // Start of with generating a public  / private key pair
        const keypair = await Sodium.boxKeyPair()
        const encryptedPrivateKey = await EncryptedPrivateKey.encrypt(keypair.privateKey, "hello world")

        await expect(encryptedPrivateKey.decrypt("helloworld")).rejects.toThrow(/wrong secret key/)
    });
});
