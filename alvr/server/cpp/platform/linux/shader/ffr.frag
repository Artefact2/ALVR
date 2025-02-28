#version 450

layout (binding = 0) uniform sampler2D src;

layout (location = 0) in vec2 uv;

layout (location = 0) out vec4 outFragColor;

layout (push_constant) uniform constants
{
    ivec2 targetResolution;
    ivec2 optimizedResolution;
    vec2 eyeSizeRatio;
    vec2 centerSize;
    vec2 centerShift;
    vec2 edgeRatio;
} FoveationVars;

vec2 TextureToEyeUV(vec2 textureUV, bool isRightEye)
{
    // flip distortion horizontally for right eye
    // left: x * 2; right: (1 - x) * 2
    return vec2((textureUV.x + float(isRightEye) * (1. - 2. * textureUV.x)) * 2., textureUV.y);
}

vec2 EyeToTextureUV(vec2 eyeUV, bool isRightEye)
{
    // saturate is used to avoid color bleeding between the two sides of the texture or with the
    // black border when filtering
    // vec2 clampedUV = saturate(eyeUV);
    // left: x / 2; right 1 - (x / 2)
    // return vec2(clampedUV.x / 2. + float(isRightEye) * (1. - clampedUV.x), clampedUV.y);
    return vec2(eyeUV.x / 2. + float(isRightEye) * (1. - eyeUV.x), eyeUV.y);
}

void main()
{
    bool isRightEye = uv.x > 0.5;
    vec2 eyeUV = TextureToEyeUV(uv, isRightEye) / FoveationVars.eyeSizeRatio;

    vec2 c0 = (1. - FoveationVars.centerSize) / 2.;
    vec2 c1 = (FoveationVars.edgeRatio - 1.) * c0 * (FoveationVars.centerShift + 1.) /
              FoveationVars.edgeRatio;
    vec2 c2 = (FoveationVars.edgeRatio - 1.) * FoveationVars.centerSize + 1.;

    vec2 loBound = c0 * (FoveationVars.centerShift + 1.) / c2;
    vec2 hiBound = c0 * (FoveationVars.centerShift - 1.) / c2 + 1.;
    vec2 underBound = vec2(eyeUV.x < loBound.x, eyeUV.y < loBound.y);
    vec2 inBound = vec2(loBound.x < eyeUV.x && eyeUV.x < hiBound.x,
                        loBound.y < eyeUV.y && eyeUV.y < hiBound.y);
    vec2 overBound = vec2(eyeUV.x > hiBound.x, eyeUV.y > hiBound.y);

    vec2 center = eyeUV * c2 / FoveationVars.edgeRatio + c1;
    vec2 d2 = eyeUV * c2;
    vec2 d3 = (eyeUV - 1.) * c2 + 1.;
    vec2 g1 = eyeUV / loBound;
    vec2 g2 = (1. - eyeUV) / (1. - hiBound);

    vec2 leftEdge = g1 * center + (1. - g1) * d2;
    vec2 rightEdge = g2 * center + (1. - g2) * d3;

    vec2 compressedUV = underBound * leftEdge + inBound * center + overBound * rightEdge;

    outFragColor = texture(src, EyeToTextureUV(compressedUV, isRightEye));
}
