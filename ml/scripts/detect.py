"""Détection de cartes (bordure blanche) par seuillage + contours, redressement en 500x700."""
import cv2, numpy as np

CARD_W, CARD_H = 400, 560  # ratio 5:7

def card_mask(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # bordure : claire (canal min élevé) et peu saturée ; seuil relatif à l'exposition de la photo
    mn = img.min(axis=2)
    h, w = mn.shape
    k = (int(min(h, w) * 0.25) | 1)
    local = cv2.blur(mn, (k, k))
    t = max(110, 0.70 * np.percentile(mn, 99.7))
    m = ((hsv[..., 1] < 70) & (mn > t) & (mn.astype(int) > local.astype(int) + 15)).astype(np.uint8) * 255
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    return m

def find_quads(img, min_area_frac=0.01):
    h, w = img.shape[:2]
    m = card_mask(img)
    # on remplit l'intérieur des bordures : contours externes de la masque comblée
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(m)
    for c in cnts:
        if cv2.contourArea(c) > 0.0003 * h * w or len(c) > 40:
            cv2.fillPoly(filled, [cv2.convexHull(c)], 255)
    k = max(15, int(min(h, w) * 0.03)) | 1
    filled = cv2.morphologyEx(filled, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (k, k)))
    m = filled
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    quads = []
    for c in cnts:
        if cv2.contourArea(c) < min_area_frac * w * h:
            continue
        rect = cv2.minAreaRect(c)
        quads.append((rect, cv2.contourArea(c)))
    return quads, m

def warp(img, rect):
    (cx, cy), (rw, rh), ang = rect
    box = cv2.boxPoints(rect).astype(np.float32)
    # ordonner : on veut côté long vertical
    if rw > rh:
        box = np.roll(box, 1, axis=0)
    # box points order: bottom-left, top-left, top-right, bottom-right (cv2) -> reorder to tl,tr,br,bl
    s = box.sum(1); d = np.diff(box, axis=1).ravel()
    tl = box[np.argmin(s)]; br = box[np.argmax(s)]; tr = box[np.argmin(d)]; bl = box[np.argmax(d)]
    src = np.array([tl, tr, br, bl], np.float32)
    dst = np.array([[0, 0], [CARD_W, 0], [CARD_W, CARD_H], [0, CARD_H]], np.float32)
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (CARD_W, CARD_H))
