namespace ParameterManager.Core.Enums;

public enum DataType
{
    Boolean,
    Integer,
    String,
    StringArray,
    ObjectArray,
    Object,
    HexString,
    Source
}

public enum ScopeLevel
{
    Global,
    Merchant,
    Outlet,
    Terminal
}

public enum ParamCategory
{
    Configuration,
    Transaction
}

public enum TemplateStatus
{
    Draft,
    Published,
    Archived
}
