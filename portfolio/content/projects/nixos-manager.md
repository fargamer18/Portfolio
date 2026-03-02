# NixOS Install Manager
**Tech:** C, GPG, NixOS

Created a secure, C-based utility that manages NixOS system packages
through a GPG-encrypted file, decrypting, editing, and re-encrypting
before triggering nixos-rebuild.

Employs trie data structures for safe package lookups
and ensures secure memory handling.
