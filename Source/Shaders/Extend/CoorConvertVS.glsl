const float dRadius = 6378137.0;
const float DTOR = 0.0174532925199432957692369077;
const float PI = 3.1415926535897932384626433833;

//正球
vec3 SphericalToCartesian(float dLongitude, float dLatitude, float dRelativeHeight)
{
    float dRadCosLat = (dRadius + dRelativeHeight) * cos(dLatitude);
    return vec3(dRadCosLat*cos(dLongitude), dRadCosLat*sin(dLongitude), (dRadius + dRelativeHeight)*sin(dLatitude));
}

//椭球
vec3 WGS84SphericalToCartesian(float dLongitude, float dLatitude, float dRelativeHeight)
{
    float x = 6378137.0;
    float y = 6378137.0;
    float z = 6356752.3142451793;
    float h = dRelativeHeight;
    vec3 radiiSquared = vec3(x*x, y*y, z*z);
    vec3 n = vec3(cos(dLatitude)*cos(dLongitude), cos(dLatitude)*sin(dLongitude), sin(dLatitude));
    vec3 k = vec3(radiiSquared.x*n.x, radiiSquared.y*n.y, radiiSquared.z*n.z);
    float gamma = sqrt(dot(n, k));
    k = k / gamma;
    n = n * h;
    return k + n;
}

vec3 GeoToMecator(float dLongitude, float dLatitude, float dRelativeHeight)
{
    float semimajorAxis = dRadius;
    float x = dLongitude * semimajorAxis;
    float y = dLatitude * semimajorAxis;
    float z = dRelativeHeight;
    return vec3(z,x,y);
}

vec3 GeoToLambert(float dLongitude, float dLatitude, float dRelativeHeight)
{
    const float EPS = 0.081991885518007637;
    const float FORTPI = 0.78539816339744828;
    const float PrimeMeridian = 0.17453292519943295;
    const float K = 11342908.450846279;
    const float Alpha = 0.79711053618197858;
    const float Rho0 = 7340565.5138015132;
    const float FalseEasting = 0.00000000000000000;
    const float FalseNorthing = 0.00000000000000000;

    float dESinB = EPS * sin(dLatitude);
    float dU = tan(FORTPI + dLatitude*0.5) * pow((1.0 - dESinB) / (1.0 + dESinB), EPS*0.5);

    float dRho = K / pow(dU, Alpha);
    float dLam = (dLongitude - PrimeMeridian) * Alpha;//相对经线坐标
    float x = dRho * sin(dLam) + FalseEasting;
    float y = Rho0 - dRho * cos(dLam) + FalseNorthing;

    return vec3(x, y, dRelativeHeight);
}

vec3 GeoToWorld(float dLongitude, float dLatitude, float dRelativeHeight)
{
    float UnitsRatio = 111319.49079327357;
    return vec3(dLongitude*UnitsRatio, dLatitude*UnitsRatio, dRelativeHeight);
}

vec3 CoorConvert(int nProjectionType, vec2 GeoPos, float rHeight)
{
    vec3 WorldPosition;
    if(nProjectionType == 0)
    {
        WorldPosition = WGS84SphericalToCartesian(GeoPos.x*DTOR, GeoPos.y*DTOR, rHeight);
    }
    else if (nProjectionType == 1)
    {
        WorldPosition = GeoToWorld(GeoPos.x, GeoPos.y, rHeight);
    }
    else if (nProjectionType == 2)
    {
        WorldPosition = GeoToMecator(GeoPos.x*DTOR, GeoPos.y*DTOR, rHeight);
    }
    else if (nProjectionType == 3)
    {
        WorldPosition = GeoToLambert(GeoPos.x*DTOR, GeoPos.y*DTOR, rHeight);
    }
    return WorldPosition;
}
