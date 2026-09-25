# lphash: the yescrypt sources of LuckyPepe's node are in yescrypt/ (2-clause BSD, see the file headers), copied verbatim from the node's
# own src/crypto/yescrypt/ so the hash matches consensus exactly. Nothing else is needed (yescrypt.c is self-contained bar sha256.c/
# insecure_memzero.c).
#   make            (STATIC=-static makes a binary that runs on any Linux)
CC ?= gcc
STATIC ?=
lphash: lphash.c yescrypt/yescrypt.c yescrypt/sha256.c yescrypt/insecure_memzero.c
	$(CC) -O2 -fomit-frame-pointer $(STATIC) -o $@ lphash.c yescrypt/yescrypt.c yescrypt/sha256.c yescrypt/insecure_memzero.c -I. -Iyescrypt
clean:
	rm -f lphash
