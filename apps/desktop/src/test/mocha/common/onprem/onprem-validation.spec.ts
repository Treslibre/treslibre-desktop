// Modified 2026 by Treslibre Project (Treslibre).
import {base64ToU8a} from '@threema/ts-utils/base64/base64-to-u8a';
import {UTF8} from '@threema/ts-utils/codec/utf8';
import {expect} from 'chai';

import {ensureEd25519PublicKey} from '~/common/crypto';
import {OPPF_FILE_SCHEMA, verifyOppfFile} from '~/common/dom/backend/onprem/oppf';
import {TestTweetNaClBackend} from '~/test/mocha/common/backend-mocks';
import {
    MOCK_OPPF,
    CORRECT_OPPF_STRING,
    WRONG_OPPF_SIGNATURE_STRING,
    LICENSE_EXPIRED_STRING,
} from '~/test/mocha/common/onprem/oppf-mock';

export function run(): void {
    describe('Check oppf parsing and validation', function () {
        const pk = '1TrQLW5sipBuw2lcc3Y/gSUGHTzNHuLPN4X9M7Y82m8=';
        const oppf = MOCK_OPPF;
        const crypto = new TestTweetNaClBackend();
        it('parse a valid oppf file', function () {
            const parsedOppf = verifyOppfFile(
                {crypto},
                [ensureEd25519PublicKey(base64ToU8a(pk))],
                UTF8.encode(CORRECT_OPPF_STRING),
            );
            expect(parsedOppf.parsed).to.deep.equal(OPPF_FILE_SCHEMA.parse(oppf));
        });

        it('Do not allow the oppf file verification to succeed when public key is not trusted', function () {
            expect(() => {
                verifyOppfFile(
                    {crypto},
                    [ensureEd25519PublicKey(base64ToU8a(pk))],
                    UTF8.encode(WRONG_OPPF_SIGNATURE_STRING),
                );
            }).to.throw('OPPF file is signed with an unknown signature key');
        });

        it('Do not allow the oppf file verification to succeed when the signature does not match', function () {
            expect(() => {
                verifyOppfFile(
                    {crypto},
                    [
                        ensureEd25519PublicKey(
                            base64ToU8a('VR4nTeVFeao9TcIJn5KaMsuW6Lc4gMC+j8z//zngvNs='),
                        ),
                    ],
                    UTF8.encode(WRONG_OPPF_SIGNATURE_STRING),
                );
            }).to.throw('Ed25519 signature is not valid');
        });

        it('Do not allow the oppf file verification to succeed when the license is expired', function () {
            expect(() => {
                verifyOppfFile(
                    {crypto},
                    [ensureEd25519PublicKey(base64ToU8a(pk))],
                    UTF8.encode(LICENSE_EXPIRED_STRING),
                );
            }).to.throw('OPPF file expired');
        });

        it('Self-verifies an OPPF file when trustedKeys is empty (TOFU unlocked ingestion §4.1)', function () {
            const parsedOppf = verifyOppfFile({crypto}, [], UTF8.encode(CORRECT_OPPF_STRING));
            expect(parsedOppf.parsed).to.deep.equal(OPPF_FILE_SCHEMA.parse(oppf));
        });

        it('Parses a cleanroom JSON provisioning payload (§4.1)', function () {
            const cleanroomJson = JSON.stringify({
                /* eslint-disable @typescript-eslint/naming-convention */
                server_id: 'chat.thr.2sx.me',
                chat_host: 'chat.thr.2sx.me',
                chat_port: 5222,
                chat_pubkey_curve25519: '6ofyP2NLh0QZWpAJiKMweHuL2M0ZgeLvP4WIxAZZkk8=',
                directory_url: 'https://thr.2sx.me/dir',
                blob_url: 'https://thr.2sx.me/blob',
                safe_url: 'https://thr.2sx.me/safe',
                push_relay_url: 'https://thr.2sx.me/push',
                admin_signing_pubkey_ed25519: 'gFYqhjw0fCWEVtTHXfgcmIz3ez4zISlRYvblgz/svds=',
                /* eslint-enable @typescript-eslint/naming-convention */
            });
            const parsedClean = verifyOppfFile({crypto}, [], UTF8.encode(cleanroomJson));
            expect(parsedClean.parsed.directory.url.href).to.equal('https://thr.2sx.me/dir/');
        });
    });
}
