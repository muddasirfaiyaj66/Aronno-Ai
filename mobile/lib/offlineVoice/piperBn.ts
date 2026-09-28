/** Bangla Piper (bn_BD-google-medium) sidecars for Sherpa-ONNX. */
export const PIPER_MODEL_FILE = "model.onnx";
export const PIPER_TOKENS_FILE = "tokens.txt";
export const PIPER_ESPEAK_ARCHIVE = "espeak-ng-data.tar.bz2";
export const PIPER_ESPEAK_DIR = "espeak-ng-data";
/** Unpatched Hugging Face onnx size. Metadata is appended once on device. */
export const PIPER_ONNX_BYTES = 76782515;
/**
 * Speaker 12 (dataset id 4811). Official samples sit near 264 Hz.
 * Speaker 15 is also high; the other ids sit near 140–175 Hz.
 */
export const PIPER_FEMALE_SPEAKER = 12;
export const PIPER_META_SUFFIX = new Uint8Array([114, 18, 10, 10, 109, 111, 100, 101, 108, 95, 116, 121, 112, 101, 18, 4, 118, 105, 116, 115, 114, 16, 10, 7, 99, 111, 109, 109, 101, 110, 116, 18, 5, 112, 105, 112, 101, 114, 114, 14, 10, 8, 108, 97, 110, 103, 117, 97, 103, 101, 18, 2, 98, 110, 114, 11, 10, 5, 118, 111, 105, 99, 101, 18, 2, 98, 110, 114, 12, 10, 7, 118, 101, 114, 115, 105, 111, 110, 18, 1, 49, 114, 15, 10, 10, 104, 97, 115, 95, 101, 115, 112, 101, 97, 107, 18, 1, 49, 114, 13, 10, 8, 104, 97, 115, 95, 103, 50, 112, 119, 18, 1, 48, 114, 16, 10, 10, 110, 95, 115, 112, 101, 97, 107, 101, 114, 115, 18, 2, 49, 54, 114, 20, 10, 11, 115, 97, 109, 112, 108, 101, 95, 114, 97, 116, 101, 18, 5, 50, 50, 48, 53, 48]);
export const PIPER_BN_TOKENS = "_ 0\n^ 1\n$ 2\n  3\n! 4\n' 5\n( 6\n) 7\n, 8\n- 9\n. 10\n: 11\n; 12\n? 13\na 14\nb 15\nc 16\nd 17\ne 18\nf 19\nh 20\ni 21\nj 22\nk 23\nl 24\nm 25\nn 26\no 27\np 28\nq 29\nr 30\ns 31\nt 32\nu 33\nv 34\nw 35\nx 36\ny 37\nz 38\næ 39\nç 40\nð 41\nø 42\nħ 43\nŋ 44\nœ 45\nǀ 46\nǁ 47\nǂ 48\nǃ 49\nɐ 50\nɑ 51\nɒ 52\nɓ 53\nɔ 54\nɕ 55\nɖ 56\nɗ 57\nɘ 58\nə 59\nɚ 60\nɛ 61\nɜ 62\nɞ 63\nɟ 64\nɠ 65\nɡ 66\nɢ 67\nɣ 68\nɤ 69\nɥ 70\nɦ 71\nɧ 72\nɨ 73\nɪ 74\nɫ 75\nɬ 76\nɭ 77\nɮ 78\nɯ 79\nɰ 80\nɱ 81\nɲ 82\nɳ 83\nɴ 84\nɵ 85\nɶ 86\nɸ 87\nɹ 88\nɺ 89\nɻ 90\nɽ 91\nɾ 92\nʀ 93\nʁ 94\nʂ 95\nʃ 96\nʄ 97\nʈ 98\nʉ 99\nʊ 100\nʋ 101\nʌ 102\nʍ 103\nʎ 104\nʏ 105\nʐ 106\nʑ 107\nʒ 108\nʔ 109\nʕ 110\nʘ 111\nʙ 112\nʛ 113\nʜ 114\nʝ 115\nʟ 116\nʡ 117\nʢ 118\nʲ 119\nˈ 120\nˌ 121\nː 122\nˑ 123\n˞ 124\nβ 125\nθ 126\nχ 127\nᵻ 128\nⱱ 129\n0 130\n1 131\n2 132\n3 133\n4 134\n5 135\n6 136\n7 137\n8 138\n9 139\ņ 140\ñ 141\n̪ 142\n̯ 143\n̩ 144\nʰ 145\nˤ 146\nε 147\n↓ 148\n# 149\n\" 150\n↑ 151\n̺ 152\n̻ 153\ng 154\nʦ 155\nX 156\n̝ 157\n̊ 158\nɝ 159\nʷ 160\n";
